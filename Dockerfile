FROM nginx/unit:1.28.0-minimal

COPY unit.conf.json /docker-entrypoint.d/.unit.conf.json

RUN mkdir -p /www
COPY extras/ /www/extras
COPY images/ /www/images
COPY nullboard.html /www

EXPOSE 80

CMD ["unitd", "--no-daemon", "--control", "unix:/var/run/control.unit.sock"]
