. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$a = Invoke-RestMethod -Uri "$base/acts/$id`?token=$t"
$latest = $a.data.taggedBuilds.latest
"latest tag -> build $($latest.buildNumber) id=$($latest.buildId)"
$b = Invoke-RestMethod -Uri "$base/acts/$id/builds/$($latest.buildId)`?token=$t"
$rm = $b.data.readme
"readme chars: $($rm.Length)"
$emojiZone = ($rm.ToCharArray() | Where-Object { [int]$_ -ge 0x2700 -and [int]$_ -le 0x2BFF }).Count
"emoji-zone chars: $emojiZone"
"has em dash: $($rm.Contains([char]0x2014))"
"has checkmark 2705: $($rm.Contains([char]0x2705))"
"first 3 lines:"
($rm -split "`n") | Select-Object -First 3
