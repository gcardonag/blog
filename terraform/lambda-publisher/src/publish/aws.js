/**
 * Thin adapters over the AWS SDK clients. They take an SDK client (the
 * aggregated `S3` / `SSM` classes from the AWS SDK v3) rather than creating
 * one, so tests can pass a stand-in; the Lambda runtime provides the SDK.
 */

/** The bucket interface syncToBucket() expects, backed by S3. */
export function s3Bucket(s3, bucketName) {
  return {
    async list() {
      const objects = new Map()
      let ContinuationToken
      do {
        const page = await s3.listObjectsV2({ Bucket: bucketName, ContinuationToken })
        for (const { Key, ETag } of page.Contents || []) {
          // For single-part uploads without KMS encryption the ETag is the
          // object's MD5. Anything else never matches, and is re-uploaded.
          objects.set(Key, (ETag || "").replace(/"/g, ""))
        }
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (ContinuationToken)
      return objects
    },

    async put({ key, body, contentType, cacheControl }) {
      // No ACL: the bucket's policy grants public read, and CloudFront serves it.
      await s3.putObject({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      })
    },

    async remove(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000)
        const result = await s3.deleteObjects({
          Bucket: bucketName,
          Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true },
        })
        if (result.Errors && result.Errors.length > 0) {
          const { Key, Code, Message } = result.Errors[0]
          throw new Error(`Failed to delete ${result.Errors.length} object(s), e.g. ${Key}: ${Code} ${Message}`)
        }
      }
    },
  }
}

/**
 * Reads the Craft connection settings, stored as a JSON SecureString:
 *   { "apiUrl": "https://connect.craft.do/links/.../api/v1",
 *     "apiKey": "...",            (optional)
 *     "folderId": "..." }
 */
export async function loadCraftSettings(ssm, parameterName) {
  let response
  try {
    response = await ssm.getParameter({ Name: parameterName, WithDecryption: true })
  } catch (err) {
    if (err.name === "ParameterNotFound") {
      throw new Error(
        `SSM parameter ${parameterName} doesn't exist yet; create it with \`npm run craft:configure\` in terraform/lambda-publisher`
      )
    }
    throw err
  }
  let settings
  try {
    settings = JSON.parse(response.Parameter.Value)
  } catch {
    throw new Error(`SSM parameter ${parameterName} is not valid JSON`)
  }
  if (!settings.apiUrl || !settings.folderId) {
    throw new Error(
      `SSM parameter ${parameterName} needs "apiUrl" and "folderId"; set it with \`npm run craft:configure\` in terraform/lambda-publisher`
    )
  }
  return settings
}
