import "./App.css";
import DetectFace from "./DetectFace";

function App() {
  return (
    <div
      className="App"
      style={{ backgroundColor: "black", color: "white", minHeight: "100vh" }}
    >
      <DetectFace />
    </div>
  );
}

export default App;
