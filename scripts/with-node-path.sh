#!/bin/sh

set -eu

if [ -d /opt/homebrew/bin ]; then
  PATH="/opt/homebrew/bin:$PATH"
fi

if [ -d /usr/local/bin ]; then
  PATH="/usr/local/bin:$PATH"
fi

export PATH
export NODE_NO_WARNINGS=1
export TSESTREE_SUPPRESS_VERSION_WARNING=true

exec "$@"
