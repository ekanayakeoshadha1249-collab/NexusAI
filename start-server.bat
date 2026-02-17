@echo off
echo ========================================
echo     NEXUS AI - Mobile App Server
echo ========================================
echo.

REM Try PHP first
where php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Starting server with PHP...
    echo [*] Local:  http://localhost:8000
    echo [*] Network: http://%COMPUTERNAME%:8000
    echo.
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        echo [*] Your Phone: http://%%a:8000
    )
    echo.
    echo [!] Press Ctrl+C to stop the server
    echo ========================================
    echo.
    php -S 0.0.0.0:8000
    goto :end
)

REM Try Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Starting server with Python...
    echo [*] Local:  http://localhost:8000
    echo.
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        echo [*] Your Phone: http://%%a:8000
    )
    echo.
    echo [!] Press Ctrl+C to stop the server
    echo ========================================
    echo.
    python -m http.server 8000
    goto :end
)

REM Try Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [*] Starting server with Node.js...
    echo [*] Installing http-server...
    call npx -y http-server -p 8000
    goto :end
)

REM No server available
echo [ERROR] No server software found!
echo.
echo Please install one of the following:
echo   - Python: https://www.python.org/downloads/
echo   - PHP: https://www.php.net/downloads
echo   - Node.js: https://nodejs.org/
echo.
pause
goto :end

:end
