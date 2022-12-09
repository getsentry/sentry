function WireframeView({hierarchy}) {
  if (!hierarchy.children) {
    return (
      <div
        data-test-id="leaf"
        style={{
          outline: '1px solid black',
          top: hierarchy.y,
          left: hierarchy.x,
          width: hierarchy.width,
          height: hierarchy.height,
          position: 'absolute',
        }}
      />
    );
  }

  return (
    <div
      data-test-id={hierarchy.type}
      style={{
        outline: '1px solid black',
        top: hierarchy.y,
        left: hierarchy.x,
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
