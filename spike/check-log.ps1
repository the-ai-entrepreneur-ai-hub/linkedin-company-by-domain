. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$runId = 'TdvHyIoWW3uv05Mdo'
$log = Invoke-RestMethod -Uri "$base/actor-runs/$runId/log?token=$t"
($log -split "`n") | Select-String -Pattern 'Pricing read|Summary|charged|charge limit|FAILED|ERROR' | Select-Object -First 12
