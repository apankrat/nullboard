# We use nginx as our base version
FROM nginx:stable-alpine 

COPY nullboard.html /usr/share/nginx/html/index.html
ADD images /usr/share/nginx/html
ADD extras /usr/share/nginx/html


