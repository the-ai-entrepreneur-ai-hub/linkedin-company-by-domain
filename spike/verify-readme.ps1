. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$b = Invoke-RestMethod -Uri "$base/acts/$id/builds/WscdYyIAdl0PueFak`?token=$t"
$rm = $b.data.readme
if (-not $rm) {
    # fall back: list builds, take the one tagged latest
    $bs = Invoke-RestMethod -Uri "$base/acts/$id/builds?token=$t&limit=3"
    foreach ($x in $bs.data.items) {
        if ($x.buildNumber -eq '0.1.12') { $rm = $x.readme; break }
    }
}
"readme length: $(($rm | Measure-Object -Character).Characters)"
"has emoji check: $($rm -match '\u2705')"
"has em dash: $($rm.Contains([char]0x2014))"
"first line: $(($rm -split "`n")[0])"
