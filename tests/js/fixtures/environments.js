export function Environments(hidden) {
  if (hidden) {
    return [{id: '1', name: 'zzz', isHidden: true}];
  } else {
    return [
      {id: '1', name: 'production', isHidden: false},
      {id: '2', name: 'staging', isHidden: false},
    ];
  }
}
