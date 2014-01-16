#!/bin/sh

set -e

echo 'Failing curl 1'
curl 'localhost:3000/auth/status' -v || true
echo; echo

echo 'Failing curl 2'
curl 'localhost:3000/auth/status' -H 'X-Auth: open now' -v || true
echo; echo

echo 'Passing curl'
curl 'localhost:3000/auth/status' -H 'X-Auth: open sesame' -v || true
echo; echo

echo 'Failing curl unrelated'
curl 'localhost:3000/non/existent/path' -v || true
echo; echo

echo 'All done'
