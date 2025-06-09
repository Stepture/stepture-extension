import { record } from "../constants/images";
type Props = {
  color: string;
  text: string;
};

const Button = (props: Props) => {
  return (
    <div>
      <button
        className={props.color === "primary" ? "btn-primary" : "btn-secondary"}
      >
        <div className="flex items-center justify-center gap-1">
          {props.color === "primary" && (
            <img src={record} alt={`${props.text} button`} />
          )}
          {props.text}
        </div>
      </button>
    </div>
  );
};

export default Button;
