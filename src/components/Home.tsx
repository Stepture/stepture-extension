import Button from "./Button";
import { stepture } from "../constants/images";

const Home = () => {
  return (
    <div className="flex items-center justify-center flex-col w-full">
      <img src={stepture} alt="Stepture Logo" className="w-18 h-18" />
      <p className="font-semibold mt-2 text-lg">Hey there, MB Triad!</p>
      <p className="text-gray text-xs mb-8 mt-2">
        You can start by capturing you steps.
      </p>
      <Button color="primary" text="Start Capture" />
      <hr className="border-gray-300 w-full my-8" />
      <Button color="secondary" text="View your docs" />
    </div>
  );
};

export default Home;
