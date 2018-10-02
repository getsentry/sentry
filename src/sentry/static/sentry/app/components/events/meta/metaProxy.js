import React from 'react';
import AnnotatedText from 'app/components/events/meta/annotatedText';

export class MetaProxy {
  constructor(root, local) {
    // entire meta object
    this._meta = root;

    this.local = !local ? root : local;
  }

  get(obj, prop) {
    if (!obj.hasOwnProperty(prop)) {
      return obj[prop];
    }

    // console.log('proxy get', prop, typeof obj[prop], this.local);

    // Make we apply proxy to all children (objects and arrays)
    if (typeof obj[prop] === 'object') {
      // Do we need to check for annotated inside of objects?
      return new Proxy(
        obj[prop],
        new MetaProxy(this._meta, this.local && this.local[prop])
      );
    }

    // console.log(this.local['']);

    // If it's not an object/array check if it is annotated
    if (this.local && this.local[prop] && this.local[prop]['']) {
      // TODO: Error checks
      const meta = this.local[prop][''];

      // so there are some options here,
      //  * return this AnnotatedText component by default
      //    * can lead to problems if we're expecting a string
      //  * decorate `obj[prop]` with `meta`
      //    * can choose to opt in to annotated text with a special function or component
      //  * ???
      return (
        <AnnotatedText
          value={obj[prop]}
          chunks={meta.chunks}
          remarks={meta.rem}
          errors={meta.err}
        />
      );
    }

    // No annotation? return default
    return obj[prop];
  }
}

export function decorateEvent(event) {
  let _meta = event._meta;

  return new Proxy(event, new MetaProxy(_meta));
}
