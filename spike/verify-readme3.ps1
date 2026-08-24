. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

# find build 0.1.12's ID, then GET that build's readme
$bs = Invoke-RestMethod -Uri "$base/acts/$id/builds?token=$t&limit=5"
$target = $bs.data.items | Where-Object { $_.buildNumber -eq '0.1.12' } | Select-Object -First 1
"build 0.1.12 id: $($target.id) status=$($target.status)"
$b = Invoke-RestMethod -Uri "$base/acts/$id/builds/$($target.id)`?token=$t"
$rm = $b.data.readme
"readme chars: $($rm.Length)"
$emoji = ($rm.ToCharArray() | Where-Object { [int]$_ -ge 0x2700 }).Count
"chars >= U+2700 (emoji zone): $emoji"
"has em dash: $($rm.Contains([char]0x2014))"
"first 3 lines:"
($rm -split "`n") | Select-Object -First 3
