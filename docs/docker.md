# Docker 部署

需要 Docker Engine 和 Docker Compose 2.24 或更新版本。

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f gods-eye-view
```

默认仅将容器 4173 端口发布到宿主机 `127.0.0.1:4173`。镜像以非 root
用户运行，服务提供构建后的前端和原有提供方 API，不使用 Vite preview。
语言菜单支持 English 和简体中文；没有提供方密钥也能启动。

更换宿主机端口：

```sh
GEV_PORT=4180 docker compose up --build -d
```

停止服务使用 `docker compose down`。提供方缓存保存在命名卷中；只有明确
需要删除缓存时才使用 `docker compose down -v`。

## 配置

可选的 `.env` 文件由 Compose 在运行时注入，并被 `.dockerignore` 排除。
服务端密钥如 `OPENAI_API_KEY`、`AISSTREAM_API_KEY`、`FIRMS_MAP_KEY` 和
`TOMTOM_API_KEY` 仅用于对应能力。不要把私有密钥作为构建参数传入镜像。
容器不提供开发模式的 `/api/setup/*` 凭据编辑接口，也不注册 `/mcp`。

`GOOGLE_MAPS_API_KEY`、`CESIUM_ION_TOKEN` 和 `MAPILLARY_CLIENT_TOKEN` 是
现有应用的浏览器配置，Compose 将它们作为公开构建参数注入。变更后需要
重新构建；它们会出现在前端产物中，须遵守提供方要求的权限和来源限制。

自定义域名通过 `.env` 中的 `GEV_ALLOWED_HOSTS=globe.example.com` 配置，多个
域名用逗号分隔。IP 地址及 localhost 保持可用，不接受通配符。公网入口的
认证和 TLS 由你的反向代理提供；保持 API 的同源请求策略，并阅读
[安全说明](../SECURITY.md)。默认 Compose 端口绑定适用于个人及私有部署。

## 网络与受限云环境

浏览器地图请求需要能访问 Esri、OpenStreetMap 和 Re:Earth；服务器的地形
高度请求也需要 `terrain.reearth.land`。更多图层依赖其提供方的出站访问。
核心图标字体已内置，不依赖 Google Fonts。可选的英文字体仍可使用系统回退。

镜像设置了 Node 官方的 `NODE_USE_ENV_PROXY=1` 和 `NODE_USE_SYSTEM_CA=1`。
如果环境提供 HTTP(S) 代理，Node 会使用该配置及系统信任链；没有代理时
照常直接连接。需要的运行时代理可以放在受保护的 `.env` 中，TLS 代理的
批准 CA 应以只读文件挂载，再通过 `NODE_EXTRA_CA_CERTS` 指向该文件。

构建时可使用 Docker 的预定义代理参数，避免把代理配置保留在运行镜像中：

```sh
docker compose build --build-arg HTTP_PROXY --build-arg HTTPS_PROXY \
  --build-arg http_proxy --build-arg https_proxy
```

需要自定义 CA 的构建支持可选 BuildKit secret `registry_ca`。用 Compose
覆盖文件把已批准的 CA 文件绑定到该构建 secret；Dockerfile 仅在 npm 安装
步骤读取它，不复制到镜像。受限云环境若需要代理主机的 DNS 映射，可在
覆盖文件的 `build.extra_hosts` 中配置既有代理的解析地址，并设置
`build.network: host`。这些覆盖属于环境配置，不必修改仓库的标准 Compose。
始终保留 TLS 和 npm 完整性验证。

## 健康检查与本地运行

`GET /healthz` 检查本地服务及构建产物，不调用外部提供方或付费 API。
上游数据源故障会反映在对应 API 和图层状态中，不代表容器本身无法启动。
未知 API 返回 JSON 404；静态服务不会暴露 `.env`、Git 或源码。

不使用容器时，可以运行：

```sh
npm ci
npm run build
npm start
```

`npm start` 从进程环境读取服务器配置和密钥。需要 dotenv 时可显式使用
`node --env-file-if-exists=.env server/standalone/start.js`。开发仍使用
`npm run dev`，以保留热更新和本地 Provider Settings。

Docker 镜像包含运行时依赖和资源，不包含浏览器 QA、Vite、测试或本地
凭据文件；请在开发 checkout 中运行单元测试和浏览器验证。
