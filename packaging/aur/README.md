# AUR packaging

These are templates for `hackerai-bin` and `hackerai-nightly-bin`. Both repackage
the official x86_64 and ARM64 AppImages from GitHub Releases. The packages are
not published until the AUR package names are registered under the project's
own AUR account and the release repository sets `AUR_SSH_PRIVATE_KEY`.

## Publishing

`.github/workflows/publish-aur.yml` is available for a release tag but stays
disabled until `vars.PUBLISH_AUR` is `true`. It selects the stable or nightly
package, then updates its version and both architectures' asset names and
checksums, builds it for the host architecture, regenerates `.SRCINFO`, and
pushes it to the AUR.

To validate a release on Arch Linux:

```bash
sudo pacman -Syu --needed base-devel github-cli jq namcap
HACKERAI_REPOSITORY=your-org/hackerai GH_TOKEN=$(gh auth token) RELEASE_TAG=v0.1.7 \
  packaging/aur/scripts/release.sh
```
