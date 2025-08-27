import { record, right_arrow } from "../constants/images";
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
        props.color === "primary"
          ? "btn-primary max-w-[300px]"
          : "btn-secondary max-w-[300px] "
      }
    >
      <div
        className={`flex items-center justify-center gap-1 relative  ${
          props.color === "google" ? "p-1" : ""
        }`}
      >
        {props.color === "primary" && (
          <img src={record} alt={`${props.text} button`} />
        )}
        <p>{props.text}</p>
        {props.color === "google" && (
          <div className=" bg-white absolute left-0 rounded-full p-1 ">
            <img
              src={right_arrow}
              alt={`${props.text} button`}
              className="w-6 h-6 animate-pulse"
            />
          </div>
        )}
      </div>
    </button>
  );
};

export default Button;
