. 'D:\serveless-apps-2026\apify$5K\tracking\get-token.ps1'
$base = 'https://api.apify.com/v2'
$t = $env:APIFY_TOKEN
$id = '0reNPvdycTAAOpOYQ'

$bs = Invoke-RestMethod -Uri "$base/acts/$id/builds?token=$t&limit=5"
foreach ($x in $bs.data.items) {
    $rm = $x.readme
    $emoji = if ($rm) { $rm.Contains([char]0x2705) } else { 'n/a' }
    $dash = if ($rm) { $rm.Contains([char]0x2014) } else { 'n/a' }
    "build $($x.buildNumber): readmeChars=$(if($rm){$rm.Length}else{0}) emoji2705=$emoji emdash=$dash"
}
