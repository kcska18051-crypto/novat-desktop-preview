$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$html = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'index.html')
$css = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'preview.css')
$failures = [System.Collections.Generic.List[string]]::new()

if ($html -notmatch 'ВЕЛИКИЙ ТЕАТР ПОБЕДЫ') {
    $failures.Add('The sidebar slogan was not updated')
}

if ($html -notmatch 'class="sidebar-pictogram sidebar-pictogram--eye"' -or
    $html -notmatch 'class="sidebar-pictogram sidebar-pictogram--vk"' -or
    $html -notmatch 'class="sidebar-pictogram sidebar-pictogram--telegram"') {
    $failures.Add('Sidebar pictograms must be rendered as clean inline SVG icons')
}

if ($html -notmatch 'class="culture-logo__name">КУЛЬТУРА\.</span>\s*<span class="culture-logo__rf">РФ</span>') {
    $failures.Add('Culture.RF logo must expose separately colored text on a transparent background')
}

$desktopDates = [regex]::Matches($html, 'class="number-day desktop-inline"').Count
$separateNumbers = [regex]::Matches($html, 'class="date-number"').Count
if ($desktopDates -eq 0 -or $separateNumbers -ne $desktopDates) {
    $failures.Add('Every desktop date must expose its number as a separate element')
}

$requiredPatterns = @(
    '#F2E6D1'
    '(?s)\.aside-part\s*\{[^}]*background-color:\s*var\(--brand-burgundy\)'
    '(?s)\.navigation__link\s*\{[^}]*border-top:\s*1px\s+solid\s+var\(--brand-yellow\)'
    '(?s)\.navigation__link\.active,\s*\.navigation__link:hover,[^{]+\{[^}]*color:\s*var\(--brand-cream\)'
    '(?s)\.menu-btn\s*\{[^}]*border:\s*1px\s+solid\s+var\(--brand-yellow\)'
    '(?s)\.data-item\s*\{[^}]*border-top-width:\s*1px'
    '(?s)\.c-list-wrap\s*>\s*\.month\s*\{[^}]*position:\s*sticky[^}]*top:\s*0'
    '(?s)\.sidebar-pictogram\s*\{[^}]*color:\s*var\(--brand-yellow\)'
    '(?s)\.aside-part\s+\.button-special\s*\{[^}]*background-color:\s*transparent\s*!important'
    '(?s)\.culture-logo__name\s*\{[^}]*color:\s*#fff'
    '(?s)\.culture-logo__rf\s*\{[^}]*color:\s*#f00'
)

foreach ($pattern in $requiredPatterns) {
    if ($css -notmatch $pattern) {
        $failures.Add("Missing approved afisha refresh rule: $pattern")
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ -ErrorAction Continue }
    exit 1
}

Write-Output 'Afisha refresh checks passed.'
