import { record, google } from "../constants/images";
type Props = {
  color: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
};

const Button = (props: Props) => {
  return (
    <button
      onClick={props.onClick}
      type="button"
      className={
        props.color === "primary" || props.color === "google"
          ? "btn-primary max-w-[300px]"
          : "btn-secondary max-w-[300px]"
      }
    >
      <div
        className={`flex items-center justify-center gap-1 relative ${
          props.color === "google" ? "p-1" : ""
        }`}
      >
        {props.color === "primary" && (
          <img src={record} alt={`${props.text} button`} />
        )}
        {props.color === "google" && (
          <div className=" bg-white absolute left-0 rounded-full p-1">
            <img
              src={google}
              alt={`${props.text} button`}
              className="w-6 h-6"
            />
          </div>
        )}
        {props.text}
      </div>
    </button>
  );
};

export default Button;
