# 0_...

This library facilitates to use [Graffiti Feeds](https://github.com/fairDataSociety/FIPs/blob/master/text/0062-graffiti-feed.md) on [Ethereum Swarm](https://www.ethswarm.org/).

![graffiti-feed-chart](https://github.com/fairDataSociety/FIPs/raw/master/resources/graffiti-feed.png)

# Install

```sh
npm install 0_... --save
```

# Compilation

In order to compile code run

```sh
npm run compile
```

You can find the resulted code under the `dist` folder.

For types compilation, run

```sh
npm run compile:types
```

# Testing

The testing needs running Bee client node for integration testing.
You must set `BEE_POSTAGE` environment variable with a valid Postage batch.

To run test execute

```sh
npm run test
```
