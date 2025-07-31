// From type-fest simplify but renamed to Flatten https://github.com/sindresorhus/type-fest/blob/5dbd7aed6ac6bb561229761ff7a3061098e47704/source/simplify.d.ts

// MIT License

// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/**
 * Useful to flatten the type output to improve type hints shown in editors.
 * And also to transform an interface into a type to aide with assignability.
 * see more examples @link https://github.com/sindresorhus/type-fest/blob/main/source/simplify.d.ts
 */
export type Flatten<T> = {[KeyType in keyof T]: T[KeyType]} & {};
