packer {
  required_plugins {
    googlecompute = {
      source  = "github.com/hashicorp/googlecompute"
      version = "~> 1"
    }
  }
}

variable "project_id" {
  default = "hubert-test-project"
}

variable "zone" {
  default = "us-central1-a"
}

source "googlecompute" "sentry-sandbox" {
  project_id          = var.project_id
  source_image_family = "ubuntu-2404-lts-amd64"
  image_family        = "sentry-sandbox"
  image_name          = "sentry-sandbox-{{timestamp}}"
  zone                = var.zone
  machine_type        = "e2-standard-8"
  disk_size           = 100
  disk_type           = "pd-ssd"
  preemptible         = true
  ssh_username        = "packer"
  state_timeout       = "30m"
  metadata = {
    enable-oslogin = "false"
  }
}

build {
  sources = ["source.googlecompute.sentry-sandbox"]

  # 1. System deps (as root) — Docker, Python, Node, uv, pnpm, devenv
  provisioner "shell" {
    execute_command = "sudo bash -eux '{{ .Path }}'"
    scripts         = ["../scripts/install-system-deps.sh"]
  }

  # 2. Create sentry user and clone repo
  provisioner "shell" {
    inline = [
      "id -u sentry &>/dev/null || sudo useradd -m -s /bin/bash sentry",
      "sudo usermod -aG docker sentry",
      "sudo mkdir -p /opt/sentry",
      "sudo git clone https://github.com/getsentry/sentry.git /opt/sentry",
      "sudo chown -R sentry:sentry /opt/sentry",
    ]
  }

  # 3. Copy build scripts and systemd units
  provisioner "shell" {
    inline = ["mkdir -p /tmp/sandbox-scripts /tmp/systemd"]
  }

  provisioner "file" {
    source      = "../scripts/"
    destination = "/tmp/sandbox-scripts/"
  }

  provisioner "file" {
    source      = "../systemd/"
    destination = "/tmp/systemd/"
  }

  provisioner "file" {
    source      = "../startup.sh"
    destination = "/tmp/startup.sh"
  }

  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt/sentry/sandbox/scripts",
      "sudo cp /tmp/sandbox-scripts/* /opt/sentry/sandbox/scripts/",
      "sudo cp /tmp/startup.sh /opt/sentry/sandbox/startup.sh",
      "sudo chown -R sentry:sentry /opt/sentry/sandbox",
      "sudo chmod +x /opt/sentry/sandbox/scripts/*.sh /opt/sentry/sandbox/startup.sh",
      "sudo cp /tmp/systemd/*.service /etc/systemd/system/",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable sandbox-startup sandbox-devserver",
    ]
  }

  # 4. devenv sync (as sentry user)
  provisioner "shell" {
    execute_command = "sudo -u sentry bash -eux '{{ .Path }}'"
    scripts = [
      "../scripts/run-devenv-sync.sh",
    ]
  }

  # 5. Pre-build frontend assets (as sentry user)
  provisioner "shell" {
    inline = [
      "cd /opt/sentry && sudo -u sentry env PATH=/usr/local/bin:$PATH pnpm build",
    ]
  }

  # 6. IDE support + optimize (as root)
  provisioner "shell" {
    execute_command = "sudo bash -eux '{{ .Path }}'"
    scripts = [
      "../scripts/install-ide-support.sh",
      "../scripts/optimize-image.sh",
    ]
  }

  # 7. Global environment + devenv symlink + direnv hook
  provisioner "shell" {
    inline = [
      "sudo ln -sf /home/sentry/.local/share/sentry-devenv/bin/devenv /usr/local/bin/devenv",
      "echo 'SENTRY_CONF=/home/sentry/.sentry/' | sudo tee -a /etc/environment",
      "echo 'PATH=/opt/sentry/.venv/bin:/home/sentry/.local/share/sentry-devenv/bin:/usr/local/bin:/usr/bin:/bin' | sudo tee -a /etc/environment",
      "echo 'eval \"$(direnv hook bash)\"' | sudo tee -a /home/sentry/.bashrc",
      # .bash_profile (created by devenv) doesn't source .bashrc, so the direnv
      # hook and other interactive shell config never loads in login shells.
      "echo '[ -f \"$HOME/.bashrc\" ] && . \"$HOME/.bashrc\"' | sudo tee -a /home/sentry/.bash_profile",
      "cd /opt/sentry && sudo -u sentry direnv allow /opt/sentry",
    ]
  }
}
