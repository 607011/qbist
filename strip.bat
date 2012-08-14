@echo off
set BINDIR=C:\Workspace\nacl_sdk\pepper_16\toolchain\win_x86_newlib\bin
%BINDIR%\i686-nacl-strip.exe qbist_www_x86_32.nexe
%BINDIR%\x86_64-nacl-strip.exe qbist_www_x86_64.nexe