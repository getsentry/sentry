`sentry`
--------

Sentry is cross-platform crash reporting built with love.

The configuration file is looked up in the `~/.sentry` config
directory but this can be overridden with the `SENTRY_CONF`
environment variable or be explicitly provided through the
`--config` parameter.

Options
```````

- ``--config PATH``: Path to configuration files.
- ``--version``: Show the version and exit.
- ``--help``: print this help page.

Subcommands
```````````

.. toctree::
 :maxdepth: 1

 files <files/index>
 repair <repair/index>
 upgrade <upgrade/index>
 run <run/index>
 help <help/index>
 exec <exec/index>
 queues <queues/index>
 plugins <plugins/index>
 devserver <devserver/index>
 django <django/index>
 start <start/index>
 init <init/index>
 cleanup <cleanup/index>
 export <export/index>
 createuser <createuser/index>
 import <import/index>
 shell <shell/index>
 config <config/index>
 tsdb <tsdb/index>
 dsym <dsym/index>

