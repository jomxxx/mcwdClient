import React, { useState, useEffect, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react"; // Import QRCodeCanvas component
import html2canvas from "html2canvas"; // Import html2canvas for screenshot functionality
import { FaSpinner } from "react-icons/fa"; // Import spinner icon
import { debounce } from "lodash"; // Import lodash debounce
import {
  format,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isWithinInterval,
  startOfToday,
  setHours,
  setMinutes,
  addMinutes,
  isAfter,
  isToday,
} from "date-fns";
import "./DateTimePicker.css";

const generateTimeSlots = (start, end, interval) => {
  const times = [];
  let current = start;
  while (current <= end) {
    times.push(format(current, "h:mma"));
    current = addMinutes(current, interval);
  }
  return times;
};

const availableTimes = generateTimeSlots(
  setMinutes(setHours(new Date(), 8), 30),
  setMinutes(setHours(new Date(), 15), 30),
  30
);

const categories = [
  { code: "REG", description: "Regular" },
  { code: "PRE", description: "Pregnant" },
  { code: "PWD", description: "PWD" },
  { code: "SNC", description: "Senior Citizen" },
];

const DateTimePicker = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [age, setAge] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isTimePopupVisible, setIsTimePopupVisible] = useState(false);
  const [isCategoryPopupVisible, setIsCategoryPopupVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false); // Track mobile view
  const [errors, setErrors] = useState({});
  const [timeSlots, setTimeSlots] = useState([]);
  const [isSubmitModalVisible, setIsSubmitModalVisible] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isTimeRestrictedModalVisible, setIsTimeRestrictedModalVisible] =
    useState(false);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false); // Add loading state
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const ageInput = document.querySelector(".input");
    let ageError = document.querySelector(".age-error");
    if (!ageError) {
      ageError = document.createElement("div");
      ageError.classList.add("age-error");
      ageError.textContent = "Age must be at least 18 years old.";
      ageInput.parentNode.insertBefore(ageError, ageInput.nextSibling);
    }

    ageInput.addEventListener("input", function () {
      const value = parseInt(ageInput.value);
      if (ageInput.value === "" || value >= 18) {
        ageError.style.display = "none";
        ageInput.classList.remove("error");
      } else {
        ageError.style.display = "block";
        ageInput.classList.add("error");
      }
    });

    // Ensure the restriction message is displayed correctly for invalid input
    ageInput.addEventListener("blur", function () {
      if (ageInput.value.length > 2) {
        ageInput.value = ageInput.value.slice(0, 2); // Trim to two digits
        const value = parseInt(ageInput.value);
        if (value < 18) {
          ageError.style.display = "block";
          ageInput.classList.add("error");
        }
      }
    });
  }, []);

  useEffect(() => {
    // Calculate the next 7 available days excluding Saturdays and Sundays
    const availableDays = [];
    let currentDay = startOfToday();
    while (availableDays.length < 7) {
      if (getDay(currentDay) !== 0 && getDay(currentDay) !== 6) {
        availableDays.push(currentDay);
      }
      currentDay = addDays(currentDay, 1);
    }

    if (availableDays.length > 0) {
      setSelectedDate(availableDays[0]);
    }
  }, []);

  useEffect(() => {
    if (isTimePopupVisible || isCategoryPopupVisible) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
  }, [isTimePopupVisible, isCategoryPopupVisible]);

  const checkTimeSlots = useCallback(
    debounce(async () => {
      if (isMobile) return; // Skip loading spinner on mobile view
      setIsLoadingTimeSlots(true); // Set loading to true
      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_BASE_URL
          }/api/appointments/fully-booked?date=${format(
            selectedDate,
            "yyyy-MM-dd"
          )}`
        );

        const fullyBookedSlots = await response.json();
        console.log("Fetched Slots:", fullyBookedSlots); // Debugging

        const now = new Date();
        const slots = availableTimes.map((time) => {
          const [hour, minute, period] = time
            .match(/(\d+):(\d+)([APM]+)/i)
            .slice(1);
          const timeDate = setMinutes(
            setHours(
              new Date(selectedDate),
              (parseInt(hour, 10) % 12) +
                (period.toUpperCase() === "PM" ? 12 : 0)
            ),
            parseInt(minute, 10)
          );

          const isPastTime = isToday(selectedDate) && !isAfter(timeDate, now);

          return {
            time,
            selectable:
              !fullyBookedSlots.some(
                (slot) =>
                  format(new Date(slot.date_selected), "yyyy-MM-dd HH:mm") ===
                  format(timeDate, "yyyy-MM-dd HH:mm")
              ) && !isPastTime,
          };
        });

        setTimeSlots(slots);
      } catch (error) {
        console.error("Error fetching time slots:", error);
      } finally {
        setIsLoadingTimeSlots(false); // Set loading to false
      }
    }, 300), // Debounce with a delay of 300ms
    [isMobile, selectedDate, availableTimes]
  );

  useEffect(() => {
    checkTimeSlots();
  }, [checkTimeSlots]);

  useEffect(() => {
    if (isSubmitModalVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isSubmitModalVisible]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setErrors((prev) => ({ ...prev, selectedDate: false }));
  };

  const handleTimeChange = async (time) => {
    if (await isTimeSelectable(time)) {
      setSelectedTime(time);
      setIsTimePopupVisible(false);
      setErrors((prev) => ({ ...prev, selectedTime: false }));
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setIsCategoryPopupVisible(false);
    setErrors((prev) => ({ ...prev, selectedCategory: false }));
  };

  const handleAgeChange = (event) => {
    let value = event.target.value;

    // Allow only up to two digits
    if (value.length > 2) {
      value = value.slice(0, 2); // Trim to two digits
    }

    setAge(value);

    if (value === "" || parseInt(value) >= 18) {
      setErrors((prev) => ({ ...prev, age: false }));
      document.querySelector(".input").classList.remove("error");
    } else {
      setErrors((prev) => ({ ...prev, age: true }));
      document.querySelector(".input").classList.add("error");
    }
  };

  const handleMonthChange = (increment) =>
    setCurrentMonth(addMonths(currentMonth, increment));

  const handleClear = () => {
    // Calculate the next 7 available days excluding Saturdays and Sundays
    const availableDays = [];
    let currentDay = startOfToday();
    while (availableDays.length < 7) {
      if (getDay(currentDay) !== 0 && getDay(currentDay) !== 6) {
        availableDays.push(currentDay);
      }
      currentDay = addDays(currentDay, 1);
    }

    setSelectedDate(availableDays.length > 0 ? availableDays[0] : new Date());
    setSelectedTime(null);
    setSelectedCategory(null);
    setAge("");
    setErrors({});
    setCurrentMonth(new Date()); // Reset to the current month
    const ageError = document.querySelector(".age-error");
    const ageInput = document.querySelector(".input");
    if (ageError) {
      ageError.style.display = "none";
      ageInput.classList.remove("error");
    }
  };

  const handleSubmit = () => {
    const newErrors = {};
    if (!selectedDate) newErrors.selectedDate = true;
    if (!selectedTime) newErrors.selectedTime = true;
    if (!selectedCategory) newErrors.selectedCategory = true;
    if (!age || parseInt(age) < 18) newErrors.age = true; // Updated minimum age to 18

    // Restriction for time between 10:30 PM and 2:00 AM
    const [hour, minute, period] = selectedTime
      ? selectedTime.match(/(\d+):(\d+)([APM]+)/i).slice(1)
      : [];
    const selectedHour =
      (parseInt(hour, 10) % 12) + (period.toUpperCase() === "PM" ? 12 : 0);
    const selectedMinute = parseInt(minute, 10);

    if (
      (selectedHour === 22 && selectedMinute >= 30) || // 10:30 PM to 11:59 PM
      selectedHour >= 23 || // 11:00 PM to 11:59 PM
      selectedHour < 2 || // 12:00 AM to 1:59 AM
      (selectedHour === 2 && selectedMinute === 0) // Exactly 2:00 AM
    ) {
      setIsTimeRestrictedModalVisible(true);
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitModalVisible(true);
  };

  const confirmSubmit = async () => {
    const selectedCategoryObj = categories.find(
      (cat) => cat.description === selectedCategory
    );

    if (!selectedCategoryObj) {
      alert("Invalid category selected.");
      return;
    }

    const appointmentData = {
      date: format(selectedDate, "yyyy-MM-dd"),
      time: selectedTime,
      category: selectedCategoryObj.code,
      category_description: selectedCategoryObj.description,
      age: age,
    };

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/appointments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(appointmentData),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConfirmationCode(data.code);
        setIsSubmitted(true);
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to submit appointment.");
      }
    } catch (error) {
      console.error("Error submitting appointment:", error);
      alert("An error occurred while submitting the appointment.");
    }
  };

  const handleCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(`Confirmation Code: ${confirmationCode}`)
        .then(() => {
          alert("Confirmation code copied to clipboard!");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
        });
    } else {
      // Fallback method for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = `Confirmation Code: ${confirmationCode}`;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        alert("Confirmation code copied to clipboard!");
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDownloadImage = () => {
    const modalContent = document.querySelector(".modal-content");
    const copyButton = document.querySelector(".modal-confirm-btn.copy-btn");
    const downloadButton = document.querySelector(
      ".modal-confirm-btn.download-btn"
    );
    const closeButton = document.querySelector(".modal-close-btn");
    const modalTitle = document.querySelector(".modal-title");

    // Temporarily hide the copy button, download button, and close button
    copyButton.style.display = "none";
    downloadButton.style.display = "none";
    closeButton.style.display = "none";
    modalTitle.style.display = "none";

    html2canvas(modalContent).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "MCWD_Appointment.png";
      link.click();

      // Restore the copy button, download button, and close button
      copyButton.style.display = "block";
      downloadButton.style.display = "block";
      closeButton.style.display = "block";
      modalTitle.style.display = "block";
    });
  };

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const startDate = startOfMonth(currentMonth);
  const endDate = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

  // Calculate empty cells before the first day of the month
  const firstDayIndex = getDay(startDate);
  const emptyCells = Array.from({ length: firstDayIndex }, (_, i) => (
    <div key={"empty-" + i} className="empty-cell"></div>
  ));

  const today = startOfToday();

  // Calculate the next 7 available days excluding Saturdays and Sundays
  const availableDays = [];
  let currentDay = today;
  while (availableDays.length < 7) {
    if (getDay(currentDay) !== 0 && getDay(currentDay) !== 6) {
      availableDays.push(currentDay);
    }
    currentDay = addDays(currentDay, 1);
  }

  const isTimeSelectable = async (time) => {
    const [hour, minute, period] = time.match(/(\d+):(\d+)([APM]+)/i).slice(1);
    const timeDate = setMinutes(
      setHours(
        new Date(),
        (parseInt(hour, 10) % 12) + (period.toUpperCase() === "PM" ? 12 : 0)
      ),
      parseInt(minute, 10)
    );

    const now = new Date(); // Current date and time

    if (!isToday(selectedDate)) {
      // Check if the time slot is fully booked
      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_BASE_URL
          }/api/appointments/fully-booked?date=${format(
            selectedDate,
            "yyyy-MM-dd"
          )}&time=${time}`
        );
        const fullyBookedSlots = await response.json();
        return !fullyBookedSlots.includes(
          `${format(selectedDate, "yyyy-MM-dd")} ${time}`
        );
      } catch (error) {
        console.error("Error checking fully booked slots:", error);
        return false;
      }
    }

    if (!isAfter(timeDate, now)) return false; // Allow only future times for today

    // Check if the time slot is fully booked
    try {
      const response = await fetch(
        `${
          process.env.REACT_APP_API_BASE_URL
        }/api/appointments/fully-booked?date=${format(
          selectedDate,
          "yyyy-MM-dd"
        )}&time=${time}`
      );
      const fullyBookedSlots = await response.json();
      return !fullyBookedSlots.includes(
        `${format(selectedDate, "yyyy-MM-dd")} ${time}`
      );
    } catch (error) {
      console.error("Error checking fully booked slots:", error);
      return false;
    }
  };

  return (
    <div className="container">
      {!isMobile && (
        <div
          className="header"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw", // Full screen width
            backgroundColor: "#00228a", // Corrected color format
            color: "white", // Added text color
            padding: "10px 0", // Added padding for better appearance
            zIndex: 1000, // Ensure it stays above other elements
            display: "flex", // Use flexbox for layout
            justifyContent: "space-between", // Space between elements
            alignItems: "center", // Center vertically
            paddingLeft: "20px", // Add padding for left content
            paddingRight: "20px", // Add padding for right content
          }}
        >
          <span
            style={{
              fontFamily: "Arial black",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            Metropolitan Cebu Water District
          </span>
          <span
            style={{
              fontSize: "14px",
              paddingRight: "35px",
              fontFamily: "Arial",
            }}
          >
            {currentDateTime.toLocaleString("en-US", {
              weekday: "long", // e.g., "Monday"
              month: "long", // e.g., "August"
              day: "numeric", // e.g., "15"
              year: "numeric", // e.g., "2025"
              hour: "2-digit", // e.g., "03"
              minute: "2-digit", // e.g., "30"
              second: "2-digit", // e.g., "45"
              hour12: true, 
            })}
          </span>
        </div>
      )}
      <div style={{ marginTop: isMobile ? "0" : "60px" }} className="card">
        {/* Adjusted margin to account for the fixed header */}
        <div className="section">
          <div className="month-selection">
            <button
              style={{
                fontSize: "30px",
                marginRight: "auto",
                color: "#174ab8",
              }}
              onClick={() => handleMonthChange(-1)}
            >
              {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  className="bi bi-caret-left-fill"
                  viewBox="0 0 16 16"
                >
                  <path d="m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z" />
                </svg>
              }
            </button>
            <span
              style={{ fontSize: "18px", fontWeight: "bold", color: "#555" }}
            >
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              style={{ fontSize: "30px", marginLeft: "auto", color: "#174ab8" }}
              onClick={() => handleMonthChange(1)}
            >
              {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="currentColor"
                  className="bi bi-caret-right-fill"
                  viewBox="0 0 16 16"
                >
                  <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z" />
                </svg>
              }
            </button>
          </div>

          <div className="calendar-header">
            {daysOfWeek.map((day, index) => (
              <div key={index} className="calendar-day">
                {day}
              </div>
            ))}
          </div>
          <div className="calendar">
            {emptyCells}
            {daysInMonth.map((date, i) => {
              const isDisabled = !availableDays.some((availableDay) =>
                isWithinInterval(date, {
                  start: availableDay,
                  end: availableDay,
                })
              );
              return (
                <button
                  key={i}
                  className={`calendar-btn ${
                    format(date, "yyyy-MM-dd") ===
                    format(selectedDate, "yyyy-MM-dd")
                      ? "active"
                      : ""
                  } ${isDisabled ? "disabled" : ""}`}
                  onClick={() => !isDisabled && handleDateChange(date)}
                  disabled={isDisabled}
                >
                  {format(date, "d")}
                </button>
              );
            })}
          </div>
          <p className="calendar-instruction">
            Only the following seven days are available for you to choose from.
            There is no availability on Saturdays or Sundays.
          </p>
        </div>

        <div className="section">
          <h3 className="subtitle"> Category</h3>
          <div className={`grid ${errors.selectedCategory ? "error" : ""}`}>
            {categories.map((category, index) => (
              <button
                key={index}
                className={`category-btn ${
                  selectedCategory === category.description ? "active" : ""
                }`}
                onClick={() => handleCategoryChange(category.description)}
              >
                {category.description}
              </button>
            ))}
          </div>
          {isMobile && (
            <button
              className="category-popup-trigger"
              onClick={() => setIsCategoryPopupVisible(true)}
            >
              {selectedCategory || "Select a Category"}
            </button>
          )}
          <div
            className={`category-popup ${
              isCategoryPopupVisible ? "active" : ""
            }`}
          >
            <div className="close-btn">
              <button
                style={{ fontSize: "30px" }}
                onClick={() => setIsCategoryPopupVisible(false)}
              >
                ×
              </button>
            </div>{" "}
            {categories.map((category, index) => (
              <button
                key={index}
                className={`category-btn ${
                  selectedCategory === category.description ? "active" : ""
                }`}
                onClick={() => handleCategoryChange(category.description)}
              >
                {category.description}
              </button>
            ))}
          </div>
          <h3 className="subtitle">Age</h3>
          <input
            type="number"
            className={`input ${errors.age ? "error" : ""}`}
            value={age}
            onChange={handleAgeChange}
            placeholder="Enter your age"
            maxLength="2" // Ensure only two digits can be entered
          />
        </div>

        <div className="section">
          <h3 className="subtitle">Appointment Slots</h3>
          {!isMobile && isLoadingTimeSlots ? ( // Show loading spinner only on web view
            <div className="loading-container">
              <FaSpinner className="spinner-icon" />
              <p>Fetching available slots...</p>
            </div>
          ) : (
            <div className={`grid ${errors.selectedTime ? "error" : ""}`}>
              {timeSlots.map(({ time, selectable }, index) => (
                <button
                  key={index}
                  className={`time-btn ${
                    selectedTime === time ? "active" : ""
                  }`}
                  onClick={() => selectable && handleTimeChange(time)}
                  disabled={!selectable}
                >
                  {time}
                </button>
              ))}
            </div>
          )}
          {isMobile && (
            <button
              className="time-popup-trigger"
              onClick={() => setIsTimePopupVisible(true)}
            >
              {selectedTime || "Select a Time"}
            </button>
          )}
          <div className={`time-popup ${isTimePopupVisible ? "active" : ""}`}>
            <div className="close-btn">
              <button
                style={{ fontSize: "30px" }}
                onClick={() => setIsTimePopupVisible(false)}
              >
                ×
              </button>
            </div>
            {isMobile && isLoadingTimeSlots ? ( // Show loading spinner only inside modal on mobile
              <div className="loading-container">
                <FaSpinner className="spinner-icon" />
                <p>Fetching available slots...</p>
              </div>
            ) : timeSlots.filter((slot) => slot.selectable).length === 0 ? (
              <p>No vacant time available</p>
            ) : (
              timeSlots
                .filter((slot) => slot.selectable)
                .map(({ time }, index) => (
                  <button
                    key={index}
                    className={`time-btn ${
                      selectedTime === time ? "active" : ""
                    }`}
                    onClick={() => handleTimeChange(time)}
                  >
                    {time}
                  </button>
                ))
            )}
          </div>
          <p className="time-instruction">
            It is fully booked if the time is not selected or shown
          </p>
          <div className="buttons">
            <button className="clear-btn" onClick={handleClear}>
              Clear
            </button>
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={
                !selectedDate ||
                !selectedTime ||
                !selectedCategory ||
                !age ||
                parseInt(age) < 18
              }
              title={
                !selectedDate ||
                !selectedTime ||
                !selectedCategory ||
                !age ||
                parseInt(age) < 18
                  ? "Please fill all the form so you can submit"
                  : ""
              }
            >
              Submit
            </button>
          </div>
        </div>
      </div>
      {isSubmitModalVisible && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">
              {isSubmitted
                ? "Appointment Submitted"
                : "Kindly check your appointment"}
            </h3>
            <p>
              <span className="modal-label">Date:</span>{" "}
              <span className="modal-detail">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </span>
            </p>
            <p>
              <span className="modal-label">Time:</span>{" "}
              <span className="modal-detail">{selectedTime}</span>
            </p>
            <p>
              <span className="modal-label">Category:</span>{" "}
              <span className="modal-detail">{selectedCategory}</span>
            </p>
            <p>
              <span className="modal-label">Age:</span>{" "}
              <span className="modal-detail">{age}</span>
            </p>
            {confirmationCode && (
              <div className="confirmation-section">
                <div className="confirmation-content">
                  <p className="confirmation-instructions">
                    Present this code:
                  </p>
                  <QRCodeCanvas value={confirmationCode} />{" "}
                  <p className="confirmation-code">
                    <span className="large-code">{confirmationCode}</span>
                  </p>
                </div>
                <div className="instruction-text">
                  <p>
                    Please remember to keep this code secure and provide it when
                    your scheduled meeting.
                  </p>
                  <p>
                    Please take note that this code is only good for 30 minutes
                    following your chosen time for booking.
                  </p>
                </div>
              </div>
            )}
            <div className="modal-buttons">
              {isSubmitted ? (
                <>
                  <button
                    className="modal-confirm-btn copy-btn"
                    onClick={handleCopy}
                  >
                    Copy
                  </button>
                  <button
                    className="modal-confirm-btn download-btn"
                    onClick={handleDownloadImage}
                  >
                    Download Image
                  </button>
                  <button
                    className="modal-close-btn"
                    onClick={() => window.location.reload()} // Refresh the page
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="modal-cancel-btn"
                    onClick={() => setIsSubmitModalVisible(false)}
                  >
                    Cancel
                  </button>
                  <button className="modal-confirm-btn" onClick={confirmSubmit}>
                    Confirm Appointment
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {isTimeRestrictedModalVisible && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="modal-title">Time Restriction</h3>
            <p>
              Appointments cannot be scheduled at this time. Please try again
              later. Thank you for your understanding.
            </p>
            <div className="modal-buttons">
              <button
                className="modal-close-btn"
                onClick={() => setIsTimeRestrictedModalVisible(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          textAlign: "center",
          marginTop: "20px",
          fontSize: "11px",
          color: "#666",
        }}
      >
        © 2025 AV System Resources and Trading Corporation. All Rights Reserved.
      </div>
    </div>
  );
};

export default DateTimePicker;
