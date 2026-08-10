FROM node:current-alpine

RUN apk --no-cache add chromium aws-cli
RUN yarn global add gatsby-cli lighthouse

WORKDIR /usr/src/app
