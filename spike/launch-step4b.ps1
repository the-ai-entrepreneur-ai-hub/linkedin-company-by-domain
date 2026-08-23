# Fix version: drop placeholder secret envVars (documented valueHash trap), set memory
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$v = Invoke-RestMethod -Uri "$base/acts/$id/versions/0.1`?token=$t"
$obj = $v.data
"current envVars: $(($obj.envVars | ConvertTo-Json -Compress))"
# placeholder @VPS_* secrets carry no usable value (hash-only). Actor is Apify-native by design.
$obj.PSObject.Properties.Remove('envVars')
$obj | Add-Member -NotePropertyName memoryMbytes -NotePropertyValue 1024 -Force
$json = $obj | ConvertTo-Json -Depth 20
$r = Invoke-RestMethod -Method Put -Uri "$base/acts/$id/versions/0.1`?token=$t" -ContentType 'application/json' -Body $json
"version patched: memory=$($r.data.memoryMbytes) buildTag=$($r.data.buildTag) envVars=$($r.data.envVars)"

$r2 = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$t&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"rebuild latest: $($r2.data.status) $($r2.data.buildNumber)"
