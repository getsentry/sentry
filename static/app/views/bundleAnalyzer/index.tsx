import {CSSProperties} from '@emotion/serialize';

function BundleAnalyzer() {
  const style: CSSProperties = {
    padding: '20px',
    width: '100%',
    height: '1000px',
  };

  return <iframe style={style as any} src="http://127.0.0.1:8888/" />;
}

export default BundleAnalyzer;
