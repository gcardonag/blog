FROM node:current-alpine

RUN apk --no-cache add chromium py3-pip
RUN pip3 install awscli
RUN yarn global add gatsby-cli lighthouse

WORKDIR /usr/src/app
