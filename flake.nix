{
  description = "Sentry environment";
  inputs = { nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable"; };

  outputs = { self, nixpkgs, }:
    let
      system = "x86_64-darwin";

      pkgs = import nixpkgs { inherit system; };
    in {
      devShells."x86_64-darwin".default = pkgs.mkShell {
        buildInputs = with pkgs; [
          # provides make
          gnumake
          pkg-config
          # required to run devservices
          # colima is a docker-compatible container runtime
          colima
          # while not needed by devservices, the docker cli itself is still useful
          # and is used by some make targets
          docker
          docker-buildx
          pyenv
          # required for pyenv's python-build
          openssl
          readline
          # required for yarn test -u
          watchman
          # required for acceptance testing
          chromedriver
        ];
        shellHook = ''
          export PYTHONUNBUFFERED=1
          export NODE_OPTIONS=--max-old-space-size=4096
        '';
      };
    };
}
