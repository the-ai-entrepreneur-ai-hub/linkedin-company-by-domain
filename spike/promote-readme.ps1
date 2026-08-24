# Promote 0.1.11 to latest + verify README serves clean copy
. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$r = Invoke-RestMethod -Method Post -Uri "$base/acts/$id/builds?version=0.1&tag=latest&token=$t&waitForFinish=240" -ContentType 'application/json' -Body '{}'
"promote latest: $($r.data.status) $($r.data.buildNumber)"

$a = Invoke-RestMethod -Uri "$base/acts/$id`?token=$t"
$rm = $a.data.readme
"readme has emoji: $([regex]::IsMatch($rm, '[\u2700-\u27BF\u{1F300}-\u{1FAFF}]', 'None') -or $rm.Contains([char]0x2705))"
"readme has em dash: $($rm.Contains([char]0x2014))"
"readme first line: $(($rm -split "`n")[0])"
