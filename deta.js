;(() => {
    function getCookie(name) {
      var b = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
  
      return b ? b.pop() : ''
    }
  
    var __commonJS = (callback, module) => () => {
      if (!module) {
        module = { exports: {} }
        callback(module.exports, module)
      }
  
      return module.exports
    }
  
    // internal/services/base-service.js
    var require_base_service = __commonJS((exports, module) => {
      var BaseService = class {
        constructor(deta) {
          this._getDeta = () => deta
        }
        get _deta() {
          return this._getDeta()
        }
        get _baseURL() {
          const { projectId, host } = this._deta.config
  
          return `https://${host}/${projectId}`
        }
        get headers() {
          const { projectKey, authToken, authType } = this._deta.config
          if (authType === 'api-key') {
            return {
              'X-API-Key': projectKey,
              'Content-Type': 'application/json',
            }
          }
  
          return {
            Authorization: authToken,
            'Content-Type': 'application/json',
          }
        }
        async request(route, payload, method = 'GET') {
          const request = {
            method,
            headers: this.headers,
            keepalive: true,
          }
          if (method !== 'GET') request['body'] = JSON.stringify(payload)
          var response = {}
          try {
            response = await fetch(`${this._baseURL}${route}`, request)
          } catch (e) {
            console.error(e)
          }
          const status = response.status
          if (status === 401) {
            throw new Error('Unauthorized')
          }
          const data = await response.json()
  
          return { status, response: data }
        }
      }
      module.exports = BaseService
    })
  
    // internal/services/base.js
    var require_base = __commonJS((exports, module) => {
      var BaseService = require_base_service()
      var isObject = (i) => Object.prototype.toString.call(i) === '[object Object]'
      var Trim = class {}
      var Increment = class {
        constructor(value) {
          this.val = value
          if (!value) {
            this.val = 1
          }
        }
      }
      var Append = class {
        constructor(value) {
          this.val = value
          if (!Array.isArray(value)) {
            this.val = [value]
          }
        }
      }
      var Prepend = class {
        constructor(value) {
          this.val = value
          if (!Array.isArray(value)) {
            this.val = [value]
          }
        }
      }
      var Base = class extends BaseService {
        constructor(deta, tableName) {
          super(deta)
          this.getTableName = () => tableName
          this.util = {
            trim: () => new Trim(),
            increment: (value) => new Increment(value),
            append: (value) => new Append(value),
            prepend: (value) => new Prepend(value),
          }
        }
        get tableName() {
          return this.getTableName()
        }
        async get(key) {
          if (typeof key !== 'string') {
            throw new TypeError('Key must be a string')
          } else if (key === '') {
            throw new Error('Key is empty')
          }
          key = encodeURIComponent(key)
          const { status, response } = await this.request(`/${this.tableName}/items/${key}`)
          if (status === 404) {
            return null
          } else if (status === 400) {
            throw new Error(response.errors[0])
          }
  
          return response
        }
        async put(item, key) {
          const payload = isObject(item) ? item : { value: item }
          if (key) payload['key'] = key
          const { status, response } = await this.request(
            `/${this.tableName}/items`,
            {
              items: [payload],
            },
            'PUT'
          )
  
          return response && status === 207 ? response['processed']['items'][0] : null
        }
        async putMany(items) {
          if (!(items instanceof Array)) throw new TypeError('Items must be an array')
          if (items.length >= 25) throw new Error("We can't put more than 25 items at a time")
          const _items = []
          items.map((item) => {
            if (isObject(item)) _items.push(item)
            else _items.push({ value: item })
          })
          const { status, response } = await this.request(
            `/${this.tableName}/items`,
            {
              items: _items,
            },
            'PUT'
          )
  
          return response
        }
        async delete(key) {
          if (typeof key !== 'string') {
            throw new TypeError('Key must be a string')
          } else if (key === '') {
            throw new Error('Key is empty')
          }
          key = encodeURIComponent(key)
          const { response } = await this.request(`/${this.tableName}/items/${key}`, {}, 'DELETE')
  
          return null
        }
        async insert(item, key) {
          const payload = isObject(item) ? item : { value: item }
          if (key) payload['key'] = key
          const { status, response } = await this.request(
            `/${this.tableName}/items`,
            {
              item: payload,
            },
            'POST'
          )
          if (status === 201) return response
          else if (status == 409) throw new Error(`Item with key ${key} already exists`)
        }
        async *fetch(query = [], pages = 10, buffer = void 0) {
          if (pages <= 0) return
          const _query = Array.isArray(query) ? query : [query]
          let _status
          let _last
          let _items
          let _count = 0
          do {
            const payload = {
              query: _query,
              limit: buffer,
              last: _last,
            }
            const { status, response } = await this.request(
              `/${this.tableName}/query`,
              payload,
              'POST'
            )
            const { paging, items } = response
            const { last } = paging
            yield items
            _last = last
            _status = status
            _items = items
            _count += 1
          } while (_status === 200 && _last && pages > _count)
        }
        async update(updates, key) {
          if (typeof key !== 'string') {
            throw new TypeError('Key must be a string')
          } else if (key === '') {
            throw new Error('Key is empty')
          }
          if (!isObject(updates)) throw new TypeError('Updates must be a JSON object')
          const payload = { set: {}, increment: {}, append: {}, prepend: {}, delete: [] }
          for (const [key2, value] of Object.entries(updates)) {
            if (value instanceof Trim) {
              payload.delete.push(key2)
            } else if (value instanceof Increment) {
              payload.increment[key2] = value.val
            } else if (value instanceof Append) {
              payload.append[key2] = value.val
            } else if (value instanceof Prepend) {
              payload.prepend[key2] = value.val
            } else {
              payload.set[key2] = value
            }
          }
          key = encodeURIComponent(key)
          const { status, response } = await this.request(
            `/${this.tableName}/items/${key}`,
            payload,
            'PATCH'
          )
          if (status == 200) {
            return null
          } else if (status == 404) {
            throw new Error(`Key '${key}' not found`)
          } else {
            throw new Error(response.errors[0])
          }
        }
      }
      module.exports = Base
    })
  
    // internal/config.js
    var require_config = __commonJS((exports, module) => {
      var Config = class {
        constructor(config) {
          const _host = config.host || 'database.deta.sh/v1'
          const _authType = config.authType
          var _projectKey, _projectId, _authToken
          if (config.authType === 'api-key') {
            _projectKey = config.projectKey || getCookie('__dpk')
            if (!_projectKey) {
              throw new Error('Project key is not defined')
            }
            _projectId = _projectKey.split('_')[0]
          } else {
            _authToken = config.authToken
            _projectId = config.projectId
          }
          this.getProjectKey = () => _projectKey
          this.getProjectId = () => _projectId
          this.getHost = () => _host
          this.getAuthToken = () => _authToken
          this.getAuthType = () => _authType
        }
        get projectKey() {
          return this.getProjectKey()
        }
        get projectId() {
          return this.getProjectId()
        }
        get host() {
          return this.getHost()
        }
        get authToken() {
          return this.getAuthToken()
        }
        get authType() {
          return this.getAuthType()
        }
      }
      module.exports = Config
    })
  
    // internal/deta.js
    var require_deta = __commonJS((exports, module) => {
      var _Base = require_base()
      var _Config = require_config()
      var Deta2 = class {
        constructor(projectKey, authToken, host) {
          var configParams
          if (authToken) {
            configParams = {
              authType: 'bearer',
              projectId: projectKey,
              authToken,
              host,
            }
          } else {
            configParams = {
              authType: 'api-key',
              projectKey,
              host,
            }
          }
          const config = new _Config(configParams)
          this.getConfig = () => config
        }
        get config() {
          return this.getConfig()
        }
        Base(tableName) {
          return new _Base(this, tableName)
        }
      }
      module.exports = Deta2
    })
  
    // index.js
    var _Deta = require_deta()
    window.Deta = function Deta(projectKey, host) {
      return new _Deta(projectKey, host)
    }
  })()
  