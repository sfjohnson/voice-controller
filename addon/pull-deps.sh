#!/bin/bash
set -e

# Set CWD to dir of script
cd "${0%/*}"

USERNAME=sfjohnson

if [[ $(uname -m) == 'arm64' ]]; then
  ARCH=macos-arm64
else
  ARCH=macos10
fi

download () {
  echo "Downloading $3 $2 platform $1"

  curl https://github.com/$USERNAME/$3/releases/download/$2/$4-$ARCH.a --create-dirs --output lib/$ARCH/$4.a -s -L

  mkdir -p include/deps/$3
  pushd include/deps/$3 > /dev/null
  curl https://github.com/$USERNAME/$3/releases/download/$2/include.zip --output include.zip -s -L
  unzip -qq include.zip
  rm include.zip
  popd > /dev/null

  curl https://github.com/$USERNAME/$3/releases/download/$2/LICENSE --create-dirs --output licenses/$3.txt -s -L
}

rm -rf lib/$ARCH include/deps

download macos   v19.7.4      portaudio        libportaudio
download all     v0.7.16      ck               libck
