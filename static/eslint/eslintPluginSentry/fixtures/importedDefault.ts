export function a(value = 0) {
  return value;
}

export function withOptions({value = 5}: {value?: number}) {
  return value;
}

export function Component({value = 5}: {value?: number}) {
  return value;
}
