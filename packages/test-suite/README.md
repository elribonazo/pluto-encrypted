# `@pluto-encrypted/test-suite`

## Overview

The `@pluto-encrypted/test-suite` package provides tools to validate and ensure the compliance of new storage implementations created by you or the community. This package is part of the `@pluto-encrypted` suite, which offers various encryption and storage solutions.

## Installation

To install the package, use npm or yarn:

```bash
npm install @pluto-encrypted/test-suite
```

or

```bash
yarn add @pluto-encrypted/test-suite
```

## Usage

### Running the Test Suite

The primary function provided by this package is `runTestSuite`. This function allows you to run compliance tests on your custom storage implementation to ensure it meets the required standards.

#### `runTestSuite`

```typescript
runTestSuite(suite: TestSuite, testStorage: RxTestStorage): void
```

**Parameters:**
- `suite`: An instance of `TestSuite`, representing the suite of tests to be run.
- `testStorage`: An instance of `RxTestStorage`, representing the storage implementation to be tested.

**Returns:**
- This function does not return a value.

**Example:**

```typescript
import { runTestSuite } from '@pluto-encrypted/test-suite';
import { createLevelDBStorage } from '@pluto-encrypted/leveldb';

const levelDBStorage = createLevelDBStorage({ /* settings */ });

runTestSuite(myTestSuite, levelDBStorage);
```

For more examples see how the test suite is used across 3 different storage instances:
- [indexdb/tests](../indexdb/tests/init.test.ts)
- [inmemory/tests](../inmemory/tests/init.test.ts)
- [leveldb/tests](../leveldb/tests/init.test.ts)

## API Reference

### Functions

#### `runTestSuite`

- **Description:** Runs the specified test suite against the provided storage implementation.
- **Parameters:**
  - `suite`: An instance of `TestSuite`.
  - `testStorage`: An instance of `RxTestStorage`.
- **Returns:** void

## Contributing

Contributions are welcome! Please read the [contribution guidelines](https://github.com/atala-community-projects/pluto-encrypted/blob/master/CONTRIBUTING.md) before making a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](https://atala-community-projects.github.io/pluto-encrypted/LICENSE.html) file for details.

## Resources

- [Documentation](https://atala-community-projects.github.io/pluto-encrypted/)
- [GitHub Repository](https://github.com/atala-community-projects/pluto-encrypted)

---
