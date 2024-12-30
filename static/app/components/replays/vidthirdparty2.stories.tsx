export default function ThirdPartyWithTwoVids() {
  return (
    <div>
      <video height="480" width="640" controls>
        <source src="https://b.web.umkc.edu/burrise/html5/part4.mp4" type="video/mp4" />
        Your browser does not support .mp4.
      </video>
      <video height="480" width="640" controls />
    </div>
  );
}
