# Ejecutar solo para una inserción real de prueba, con Netlify Dev activo.
# Revisar LRANGE bookstore 0 -1 antes; no repetir si ya hay un mensaje de prueba.
param([string]$BaseUrl = 'http://localhost:8888')
$body = @{
    title = 'Distributed Systems Test'
    edition = '1st'
    copyright = 2026
    language = 'ENGLISH'
    pages = 250
    author = 'Andrew S. Tanenbaum'
    author_id = 2
    publisher = 'Pearson Education'
    publisher_id = 2
} | ConvertTo-Json -Compress
$temp = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($temp, $body, ([System.Text.UTF8Encoding]::new($false)))
    curl.exe -i --max-time 35 -X POST "$BaseUrl/.netlify/functions/bookInsert" -H 'Content-Type: application/json' --data-binary "@$temp"
    Write-Host 'Comprueba LRANGE bookstore 0 -1 en Redis Insight antes de repetir la solicitud.'
} finally { Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue }
