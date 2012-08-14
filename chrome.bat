@echo off
cd C:\Workspace\nacl_sdk\pepper_16\examples\qbist_www
set NACLVERBOSITY=3
set NACL_SRPC_DEBUG=1
set NACL_EXE_STDOUT=C:\Workspace\nacl_sdk\pepper_16\examples\qbist_www\out.txt
set NACL_EXE_STDERR=C:\Workspace\nacl_sdk\pepper_16\examples\qbist_www\err.txt
C:\Users\Admin\AppData\Local\Google\Chrome\Application\chrome.exe --enable-nacl --no-sandbox "http://localhost:5103/qbist_www/index.html"