export async function getMonitors() {
  const monitors = await listKV('s_')
  return monitors.keys
}

export async function getMonitorsHistory() {
  const monitorsHistory = await listKV('h_', 600)
  return monitorsHistory.keys
}

export async function getLastUpdate() {
  return await getKV('lastUpdate')
}

export async function listKV(prefix = '', cacheTtl = false) {
  const cacheKey = 'list_' + prefix + '_' + process.env.BUILD_ID
  const cachedResponse = await getKV(cacheKey)

  if (cacheTtl && cachedResponse) {
    return JSON.parse(cachedResponse)
  }

  let list = []
  let cursor = null
  let res = {}
  do {
    res = await KV_STATUS_PAGE.list({ prefix: prefix, cursor })
    list = list.concat(res.keys)
    cursor = res.cursor
  } while (!res.list_complete)

  if (cacheTtl) {
    await setKV(cacheKey, JSON.stringify({ keys: list }), null, 600)
  }
  return { keys: list }
}

export async function setKV(key, value, metadata, expirationTtl) {
  return KV_STATUS_PAGE.put(key, value, { metadata, expirationTtl })
}

export async function getKV(key, type = 'text') {
  return KV_STATUS_PAGE.get(key, type)
}

export async function getKVWithMetadata(key) {
  return KV_STATUS_PAGE.getWithMetadata(key)
}

export async function deleteKV(key) {
  return KV_STATUS_PAGE.delete(key)
}

export async function gcMonitors(config) {
  const checkKvPrefix = 's_'

  const monitors = config.monitors.map(key => {
    return key.id
  })

  const kvMonitors = await listKV(checkKvPrefix)
  const kvState = kvMonitors.keys.map(key => {
    return key.metadata.id
  })

  const keysForRemoval = kvState.filter(x => !monitors.includes(x))

  keysForRemoval.forEach(key => {
    console.log('gc: deleting ' + checkKvPrefix + key)
    deleteKV(checkKvPrefix + key)
  })
}

async function notifySlack(monitor, metadata) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Some monitor is now in :this: status`,
      },
    },
  ]
  return fetch(SECRET_SLACK_WEBHOOK_URL, {
    body: JSON.stringify({ blocks }),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}