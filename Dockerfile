# Node 24 LTS satisfies the application's >=24.14.0 <25 runtime contract.
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1 NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=registry_ca,target=/run/secrets/registry_ca \
    if [ -f /run/secrets/registry_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/registry_ca; fi; npm ci
COPY . .
# These are browser-visible configuration values, never private server secrets.
ARG GOOGLE_MAPS_API_KEY=""
ARG CESIUM_ION_TOKEN=""
ARG MAPILLARY_CLIENT_TOKEN=""
RUN GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY" \
    CESIUM_ION_TOKEN="$CESIUM_ION_TOKEN" \
    MAPILLARY_CLIENT_TOKEN="$MAPILLARY_CLIENT_TOKEN" npm run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 PUPPETEER_SKIP_DOWNLOAD=1 NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=registry_ca,target=/run/secrets/registry_ca \
    if [ -f /run/secrets/registry_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/registry_ca; fi; npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/build/browser-headers.js /app/build/allowedHosts.js ./build/
COPY --from=build /app/scripts/google-server-key.mjs ./scripts/google-server-key.mjs
# Cloud checkouts may have 0700/0600 modes. Make shipped public code readable
# without changing ownership or permitting the runtime user to edit it.
RUN chmod -R a+rX server src build scripts dist \
    && chmod a+r package.json package-lock.json \
    && mkdir -p .gev-cache .gev-logs \
    && chown node:node .gev-cache .gev-logs
USER node
EXPOSE 4173
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/standalone/start.js"]
