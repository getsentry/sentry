function WireframeView({hierarchy}) {
  if (!hierarchy.children) {
    return (
      <div
        data-test-id="leaf"
        style={{
          border: '1px solid black',
          top: hierarchy.y - 1,
          left: hierarchy.x - 1,
          width: hierarchy.width,
          height: hierarchy.height,
          position: 'absolute',
        }}
      />
    );
  }

  return (
    <div
      data-test-id="node"
      style={{
        border: '1px solid black',
        top: hierarchy.y - 1,
        left: hierarchy.x - 1,
        width: hierarchy.width,
        height: hierarchy.height,
        position: 'absolute',
      }}
    >
      {hierarchy.children.map((node, index) => (
        <WireframeView key={`${hierarchy.type}-${index}`} hierarchy={node} />
      ))}
    </div>
  );
}

export {WireframeView};
