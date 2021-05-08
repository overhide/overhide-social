# BUILDING
#
#   docker build -t oh-social -f main/docker/Dockerfile .
#
#   -> build from root of this source (cd ../.. from here)  
#
# RUNNING
#
#   docker run --rm --name oh-social -p 8120:8120 oh-social
#
#   -> map to 0.0.0.0:8120 so localhost 8120 works for running tests against container
#   -> if running in VirtualBox (docker-machine) ensure to port forward port 8120 in the docker-machine VM ('default')
#   -> if using docker-machine, make sure to stop machine before running node.js outside of docker:  `docker-machine stop`
#

FROM node:12.21.0

EXPOSE 8120

WORKDIR /home/node/app
COPY package.json LICENSE /home/node/app/
COPY main/js /home/node/app/main/js/
COPY main/static /home/node/app/main/static/
COPY test /home/node/app/test/
COPY tools /home/node/app/tools/

ENV PORT 8120

LABEL license MIT

RUN npm install

CMD ["npm", "run", "start"]
