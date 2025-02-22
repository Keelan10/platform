# Ulixee

Ulixee is a scraping [engine][hero] with a built-in deployment [unit][datastore] that enables out-of-the-box [querying][stream] across a horizontal [deployment][cloud].

This repository is the development home to several of the tools that make it easy to build and manage these scripts, including [Ulixee Desktop](desktop), [Miner][cloud] and [Datastore][datastore].

## Projects

- Hero `/hero`. The Automated Browser Engine built for scraping. (repository home - https://github.com/ulixee/hero).
- Datastore `/datastore`. Packaged "database" containing API access to crawler functions and runner functions.
- Miner `/cloud`. Run Ulixee tooling on a remote machine.
- Stream `/stream`. Query, transform and compose Datastores running on any machine.
- Desktop `/desktop`. Supercharge scraper script development using a Hero Replay toolset, remote Datastore viewer and Error troubleshooter.

## Tooling

Try out Ulixee Desktop! The Alpha release is available for download under [Assets](https://github.com/ulixee/platform/releases/latest).

### Docker

We publish a Docker image of the latest Ulixee Miner to:
- Github Container Registry: `docker pull ghcr.io/ulixee/ulixee-miner && docker tag ghcr.io/ulixee/ulixee-miner ulixee/ulixe-miner`
- DockerHub: `docker pull ulixee/ulixee-miner`

To use the image, we have a [run.sh](./cloud/tools/docker/run.sh) script that will run with a non-root user on your choice of port. All environmental configurations are listed [here](./cloud/main/.env.defaults).

## Developer Environment

This project serves as a Monorepo for developing the Ulixee Apps, Hero, Datastore and Miner. To install this project, you'll need to:

1. Clone with `--recursive` so that submodules are initialized.
2. Run `yarn build:all` from the main repository.

Learn more about Ulixee at [ulixee.org](https://ulixee.org).

## Contributing

See [How to Contribute](https://ulixee.org/how-to-contribute) for ways to get started.

This project has a [Code of Conduct](https://ulixee.org/code-of-conduct). By interacting with this repository, organization, or community you agree to abide by its terms.

We'd love your help in making Ulixee a better set of tools. Please don't hesitate to send a pull request.

## License

[MIT](LICENSE.md)

[hero]: https://github.com/ulixee/hero
[datastore]: datastore
[stream]: ./
[cloud]: cloud
