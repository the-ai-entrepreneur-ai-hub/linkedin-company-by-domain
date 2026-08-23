FROM apify/actor-node:22

COPY package*.json ./
RUN npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && rm -rf ~/.npm

COPY . ./

CMD ["node", "src/main.js"]
