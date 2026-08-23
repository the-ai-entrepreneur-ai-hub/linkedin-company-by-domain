# Clean version envVars + set actor defaultRunOptions
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

# 1) version: drop placeholder envVars only
$v = Invoke-RestMethod -Uri "$base/acts/$id/versions/0.1`?token=$t"
$obj = $v.data
$obj.PSObject.Properties.Remove('envVars')
$json = $obj | ConvertTo-Json -Depth 20
$r = Invoke-RestMethod -Method Put -Uri "$base/acts/$id/versions/0.1`?token=$t" -ContentType 'application/json' -Body $json
"version: buildTag=$($r.data.buildTag) envVars=$($r.data.envVars)"

# 2) actor-level run defaults (memoryMbytes lives here)
$rb = Invoke-RestMethod -Method Put -Uri "$base/acts/$id`?token=$t" -ContentType 'application/json' -Body '{"defaultRunOptions":{"build":"latest","memoryMbytes":1024,"timeoutSecs":3600,"maxTotalChargeUsd":25}}'
"defaultRunOptions: $($rb.data.defaultRunOptions | ConvertTo-Json -Compress)"
$p = $rb.data.pricingInfos | Select-Object -Last 1
"pricing intact: $($p.pricingModel) events=$(($p.pricingPerEvent.actorChargeEvents.PSObject.Properties.Name) -join ',')"

# 3) rebuild latest
$r2 = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$t&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"rebuild latest: $($r2.data.status) $($r2.data.buildNumber)"
