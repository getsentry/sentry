{
  description = "Sentry environment";
  inputs = { nixpkgs.url = "github:NixOS/nixpkgs/release-23.05"; };

  outputs = { self, nixpkgs, }:
    let
      system = "x86_64-darwin";

      pkgs = import nixpkgs { inherit system; };
    in {
      devShells."x86_64-darwin".default = pkgs.mkShell {
        shellHook = ''
          export TEST="hello"
        '';
      };
    };
}
