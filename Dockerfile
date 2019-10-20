FROM node:current-alpine

RUN apk --no-cache add chromium
RUN yarn global add gatsby-cli lighthouse