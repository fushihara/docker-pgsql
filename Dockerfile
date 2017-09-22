FROM node:8.5.0
ENV TZ=Asia/Tokyo
ENV APP_ROOT /usr/src/sample-node
RUN groupadd -g 500 ec2-user && useradd -g ec2-user -u 500 --create-home ec2-user

COPY . $APP_ROOT
RUN chown -R ec2-user:ec2-user $APP_ROOT
RUN mkdir /usr/src/volume-a && chown -R ec2-user:ec2-user /usr/src/volume-a
RUN mkdir /usr/src/volume-b && chown -R ec2-user:ec2-user /usr/src/volume-b

USER ec2-user
WORKDIR $APP_ROOT
RUN npm install

ENTRYPOINT ["npm","start"]
