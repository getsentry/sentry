declare global {
  interface ArrayConstructor {
    isArray(arg: any): arg is any[] | readonly any[];
  }
}

export {};
