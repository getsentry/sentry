function ViewHierarchyTree({hierarchy}) {
  return (
    <div style={{maxHeight: '500px', overflow: 'auto'}}>
      <pre>{JSON.stringify(hierarchy, null, 2)}</pre>
    </div>
  );
}

export {ViewHierarchyTree};
