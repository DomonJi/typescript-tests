/// <reference path='fourslash.ts' />

// @strict: true

//// class T {
////     // comment
////     a: 2;
//// }

verify.codeFix({
    description: `Add initializer to property 'a'`,
    newFileContent: `class T {
    // comment
    a: 2 = 2;
}`,
    index: 2
})
